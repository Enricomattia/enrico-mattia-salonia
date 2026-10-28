// Bundled for both static apps by scripts/pathos-review-editor.cjs.
import {Schema} from 'prosemirror-model';
import {EditorState, TextSelection} from 'prosemirror-state';
import {EditorView} from 'prosemirror-view';
import {baseKeymap, chainCommands, lift, toggleMark, wrapIn} from 'prosemirror-commands';
import {history, undo, redo} from 'prosemirror-history';
import {keymap} from 'prosemirror-keymap';
import {liftListItem, sinkListItem, splitListItem, wrapInList} from 'prosemirror-schema-list';
import {MarkdownParser, MarkdownSerializer, defaultMarkdownSerializer} from 'prosemirror-markdown';

function webUrl(value) {
  const url = String(value || '').trim();
  if (!/^https?:\/\//i.test(url) || /[\u0000-\u0020]/.test(url)) return '';
  try {return ['http:','https:'].includes(new URL(url).protocol) ? url : '';} catch {return '';}
}

const schema = new Schema({
  nodes: {
    doc: {content:'block+'},
    paragraph: {content:'inline*',group:'block',parseDOM:[{tag:'p'}],toDOM:() => ['p',0]},
    blockquote: {content:'block+',group:'block',defining:true,parseDOM:[{tag:'blockquote'}],toDOM:() => ['blockquote',0]},
    bullet_list: {content:'list_item+',group:'block',attrs:{tight:{default:true}},parseDOM:[{tag:'ul'}],toDOM:() => ['ul',0]},
    ordered_list: {content:'list_item+',group:'block',attrs:{order:{default:1},tight:{default:true}},parseDOM:[{tag:'ol',getAttrs:dom => ({order:Number(dom.getAttribute('start')) || 1})}],toDOM:node => ['ol',{start:node.attrs.order === 1 ? null : node.attrs.order},0]},
    list_item: {content:'paragraph block*',defining:true,parseDOM:[{tag:'li'}],toDOM:() => ['li',0]},
    text: {group:'inline'},
    hard_break: {inline:true,group:'inline',selectable:false,parseDOM:[{tag:'br'}],toDOM:() => ['br']}
  },
  marks: {
    em: {parseDOM:[{tag:'em'},{tag:'i'},{style:'font-style=italic'},{style:'font-style=normal',clearMark:mark => mark.type.name === 'em'}],toDOM:() => ['em',0]},
    strong: {parseDOM:[{tag:'strong'},{tag:'b',getAttrs:dom => dom.style.fontWeight !== 'normal' && null},{style:'font-weight=400',clearMark:mark => mark.type.name === 'strong'},{style:'font-weight',getAttrs:value => /^(bold(er)?|[5-9]\d{2,})$/.test(value) ? null : false}],toDOM:() => ['strong',0]},
    strike: {parseDOM:[{tag:'s'},{tag:'del'},{tag:'strike'},{style:'text-decoration',getAttrs:value => /line-through/.test(value) ? null : false}],toDOM:() => ['s',0]},
    code: {code:true,parseDOM:[{tag:'code'}],toDOM:() => ['code',0]},
    link: {attrs:{href:{},title:{default:null}},inclusive:false,
      parseDOM:[{tag:'a[href]',getAttrs:dom => webUrl(dom.getAttribute('href')) ? {href:webUrl(dom.getAttribute('href')),title:dom.getAttribute('title')} : false}],
      toDOM:mark => ['a',{href:webUrl(mark.attrs.href),title:mark.attrs.title,target:'_blank',rel:'noopener noreferrer'},0]}
  }
});

// Use the reading page's exact Markdown dialect, including soft line breaks.
const parser = new MarkdownParser(schema, {parse:source => globalThis.PathosReview.tokens(source)}, {
  paragraph:{block:'paragraph'},blockquote:{block:'blockquote'},list_item:{block:'list_item'},
  bullet_list:{block:'bullet_list'},ordered_list:{block:'ordered_list',getAttrs:token => ({order:Number(token.attrGet('start')) || 1})},
  softbreak:{node:'hard_break'},hardbreak:{node:'hard_break'},
  em:{mark:'em'},strong:{mark:'strong'},s:{mark:'strike'},code_inline:{mark:'code',noCloseToken:true},
  link:{mark:'link',getAttrs:token => ({href:token.attrGet('href'),title:token.attrGet('title') || null})}
});
const serializer = new MarkdownSerializer({
  ...defaultMarkdownSerializer.nodes,
  bullet_list(state,node) {state.renderList(node,'  ',() => '- ');}
}, {
  ...defaultMarkdownSerializer.marks,
  strike:{open:'~~',close:'~~',mixable:true,expelEnclosingWhitespace:true},
  // The reader deliberately disables autolinks, so always use explicit links.
  link:{open:'[',close:(_state,mark) => ']('+mark.attrs.href.replace(/[()"\\]/g,'\\$&')+(mark.attrs.title ? ' "'+mark.attrs.title.replace(/["\\]/g,'\\$&')+'"' : '')+')',mixable:true}
}, {escapeExtraCharacters:/[~<>&]/g});

export function attach(editor) {
  const source = editor.querySelector('textarea');
  const surface = editor.querySelector('.review-surface');
  const form = editor.closest('form');
  const buttons = [...editor.querySelectorAll('[data-review-command]')];
  const panel = editor.querySelector('.review-link-editor');
  const urlInput = editor.querySelector('[data-review-link-url]');
  const linkError = editor.querySelector('[data-review-link-error]');
  let originalSource = '', originalDoc, savedLinkSelection = null;
  let view;

  function ancestor(type) {
    const {$from} = view.state.selection;
    for (let depth=$from.depth; depth>0; depth--) if ($from.node(depth).type === type) return {node:$from.node(depth),pos:$from.before(depth)};
    return null;
  }
  function markActive(type) {
    const {from,to,empty,$from} = view.state.selection;
    return empty ? Boolean(type.isInSet(view.state.storedMarks || $from.marks())) : view.state.doc.rangeHasMark(from,to,type);
  }
  const markNames = {bold:'strong',italic:'em',strike:'strike',link:'link'};
  function updateControls() {
    for (const button of buttons) {
      const command = button.dataset.reviewCommand;
      const active = markNames[command] ? markActive(schema.marks[markNames[command]]) : Boolean(ancestor(schema.nodes[{quote:'blockquote',bullet:'bullet_list',number:'ordered_list'}[command]]));
      button.setAttribute('aria-pressed',String(active));
    }
    surface.classList.toggle('is-empty',view.state.doc.childCount === 1 && view.state.doc.firstChild.type === schema.nodes.paragraph && view.state.doc.firstChild.content.size === 0);
  }
  function syncSource() {
    // No-op edits and undo preserve the original string, including whitespace.
    source.value = view.state.doc.eq(originalDoc) ? originalSource : serializer.serialize(view.state.doc,{tightLists:true});
  }
  function closeLink(focus=false) {
    panel.hidden = true;urlInput.value = '';linkError.hidden = true;savedLinkSelection = null;
    if (focus) view.focus();
  }
  function createState(doc) {
    return EditorState.create({schema,doc,plugins:[
      history(),
      keymap({
        'Mod-b':toggleMark(schema.marks.strong),'Mod-i':toggleMark(schema.marks.em),
        'Mod-k':() => {openLink();return true;},
        'Mod-z':undo,'Shift-Mod-z':redo,'Mod-y':redo,
        'Enter':chainCommands(splitListItem(schema.nodes.list_item),baseKeymap.Enter),
        'Shift-Enter':(state,dispatch) => {dispatch(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView());return true;},
        'Tab':sinkListItem(schema.nodes.list_item),'Shift-Tab':liftListItem(schema.nodes.list_item)
      }),keymap(baseKeymap)
    ]});
  }
  function reset() {
    closeLink();originalSource = source.value;
    originalDoc = parser.parse(originalSource);
    view.updateState(createState(originalDoc));updateControls();
  }
  originalSource = source.value;originalDoc = parser.parse(originalSource);
  view = new EditorView(surface, {
    state:createState(originalDoc),
    attributes:{id:'reviewRichInput',role:'textbox','aria-multiline':'true','aria-labelledby':'reviewLabel','aria-placeholder':'What stayed with you?','spellcheck':'true'},
    dispatchTransaction(transaction) {
      const next = view.state.apply(transaction);view.updateState(next);
      if (transaction.docChanged) syncSource();
      updateControls();
    },
    // Links remain editable text; clicking them does not leave the entry form.
    handleDOMEvents:{click:(_view,event) => {if (event.target.closest('a')) {event.preventDefault();return true;}return false;}}
  });
  source.hidden = true;surface.hidden = false;updateControls();

  function toggleList(type) {
    const active = ancestor(type);
    if (active) return liftListItem(schema.nodes.list_item)(view.state,view.dispatch);
    const other = ancestor(type === schema.nodes.bullet_list ? schema.nodes.ordered_list : schema.nodes.bullet_list);
    if (other) {view.dispatch(view.state.tr.setNodeMarkup(other.pos,type));return true;}
    return wrapInList(type)(view.state,view.dispatch);
  }
  function linkSelection() {
    const {from,to,empty,$from} = view.state.selection;
    if (!empty) return {from,to,href:(schema.marks.link.isInSet($from.marks()) || schema.marks.link.isInSet($from.nodeAfter?.marks || []))?.attrs.href || ''};
    const mark = schema.marks.link.isInSet($from.marks()) || schema.marks.link.isInSet($from.nodeAfter?.marks || []);
    if (!mark) return {from,to,href:''};
    const children=[];
    $from.parent.forEach((node,offset) => children.push({node,pos:$from.start()+offset}));
    const index=children.findIndex(({node,pos}) => mark.isInSet(node.marks) && pos<=from && pos+node.nodeSize>=from);
    if (index<0) return {from,to,href:mark.attrs.href};
    let first=index,last=index;
    while(first>0 && mark.isInSet(children[first-1].node.marks))first--;
    while(last+1<children.length && mark.isInSet(children[last+1].node.marks))last++;
    return {from:children[first].pos,to:children[last].pos+children[last].node.nodeSize,href:mark.attrs.href};
  }
  function openLink() {
    savedLinkSelection = linkSelection();panel.hidden = false;linkError.hidden = true;
    urlInput.value = savedLinkSelection.href;urlInput.focus();urlInput.select();
    editor.querySelector('[data-review-link-remove]').hidden = !savedLinkSelection.href;
  }
  function applyLink(remove=false) {
    if (!savedLinkSelection) return;
    const href = webUrl(urlInput.value);
    if (!remove && !href) {linkError.hidden = false;urlInput.focus();return;}
    const {from,to} = savedLinkSelection;
    let tr = view.state.tr;
    if (remove) tr = tr.removeMark(from,to,schema.marks.link);
    else if (from === to) {
      tr = tr.insertText(href,from,to).addMark(from,from+href.length,schema.marks.link.create({href}));
      tr = tr.setSelection(TextSelection.create(tr.doc,from+href.length));
    } else tr = tr.addMark(from,to,schema.marks.link.create({href}));
    view.dispatch(tr.scrollIntoView());closeLink(true);
  }
  const commands = {
    bold:toggleMark(schema.marks.strong),italic:toggleMark(schema.marks.em),strike:toggleMark(schema.marks.strike),
    quote:() => ancestor(schema.nodes.blockquote) ? lift(view.state,view.dispatch) : wrapIn(schema.nodes.blockquote)(view.state,view.dispatch),
    bullet:() => toggleList(schema.nodes.bullet_list),number:() => toggleList(schema.nodes.ordered_list)
  };
  buttons.forEach(button => {
    button.addEventListener('mousedown',event => event.preventDefault());
    button.addEventListener('click',() => {
      if (button.dataset.reviewCommand === 'link') {openLink();return;}
      closeLink();commands[button.dataset.reviewCommand](view.state,view.dispatch);view.focus();updateControls();
    });
  });
  editor.querySelector('[data-review-link-apply]').addEventListener('click',() => applyLink());
  editor.querySelector('[data-review-link-remove]').addEventListener('click',() => applyLink(true));
  editor.querySelector('[data-review-link-cancel]').addEventListener('click',() => closeLink(true));
  urlInput.addEventListener('keydown',event => {
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();event.stopPropagation();
      if (event.key === 'Enter') applyLink();else closeLink(true);
    }
  });
  source.addEventListener('input',reset);
  form.addEventListener('submit',syncSource,{capture:true});
  return {reset};
}
