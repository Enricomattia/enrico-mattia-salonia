/* Presentation-only review formatting. Keep the Personal copy identical. */
(function () {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const markdown = globalThis.markdownit?.({html:false,breaks:true,linkify:false,typographer:false})
    .disable(['image','table','heading','lheading','hr','code','fence','autolink']);
  if (markdown) {
    // Reviews never embed HTML or remote images. Only explicit web links open.
    const validate = markdown.validateLink.bind(markdown);
    markdown.validateLink = url => /^https?:\/\//i.test(url) && validate(url);
    markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
      tokens[index].attrSet('target', '_blank');
      tokens[index].attrSet('rel', 'noopener noreferrer');
      return renderer.renderToken(tokens, index, options);
    };
  }
  function render(value) {
    const source = String(value ?? '');
    return markdown ? markdown.render(source) : escape(source).replace(/\n/g, '<br>');
  }
  function text(value) {
    const source = String(value ?? '');
    if (!markdown) return source;
    const content = tokens => tokens.map(token => {
      if (token.children) return content(token.children);
      if (['text','code_inline'].includes(token.type)) return token.content;
      if (token.type === 'paragraph_close') return '\n\n';
      if (['softbreak','hardbreak'].includes(token.type) || token.block && token.nesting === -1) return '\n';
      return '';
    }).join('');
    return content(markdown.parse(source, {})).replace(/\n{3,}/g, '\n\n').trim();
  }
  function attach(editor) {
    const input = editor.querySelector('textarea');
    const preview = editor.querySelector('.review-preview');
    const toggle = editor.querySelector('[data-review-preview]');
    const buttons = [...editor.querySelectorAll('[data-review-command]')];
    let previewing = false;
    function showPreview(active) {
      previewing = active;
      input.hidden = active;
      preview.hidden = !active;
      toggle.setAttribute('aria-pressed', String(active));
      buttons.forEach(button => button.disabled = active);
      if (active) preview.innerHTML = input.value.trim() ? render(input.value) : '<p class="meta">No review yet.</p>';
    }
    function replace(start, end, replacement, selectStart, selectEnd) {
      input.focus({preventScroll:true});
      input.setSelectionRange(start, end);
      // Native insertion preserves the textarea's undo history where supported.
      if (!document.execCommand?.('insertText', false, replacement)) input.setRangeText(replacement, start, end, 'end');
      input.setSelectionRange(selectStart, selectEnd);
      input.dispatchEvent(new Event('input', {bubbles:true}));
    }
    function format(command) {
      let start = input.selectionStart, end = input.selectionEnd;
      let selected = input.value.slice(start, end);
      const markers = {bold:'**',italic:'*',strike:'~~'};
      if (markers[command]) {
        if (selected.trim()) {
          start += selected.length-selected.trimStart().length;
          end -= selected.length-selected.trimEnd().length;
          selected = selected.trim();
        }
        const marker = markers[command], size = marker.length;
        const starCount = (value, pattern) => value.match(pattern)?.[0].length || 0;
        const italicOutside = command !== 'italic' || starCount(input.value.slice(0,start), /\*+$/)%2 === 1 && starCount(input.value.slice(end), /^\*+/)%2 === 1;
        const italicInside = command !== 'italic' || starCount(selected, /^\*+/)%2 === 1 && starCount(selected, /\*+$/)%2 === 1;
        if (italicOutside && start >= size && input.value.slice(start-size, start) === marker && input.value.slice(end, end+size) === marker) {
          replace(start-size, end+size, selected, start-size, end-size);
        } else if (italicInside && selected.length > size*2 && selected.startsWith(marker) && selected.endsWith(marker)) {
          const plain = selected.slice(size, -size);
          replace(start, end, plain, start, start+plain.length);
        } else {
          const value = selected || 'text';
          replace(start, end, marker+value+marker, start+size, start+size+value.length);
        }
      } else if (command === 'link') {
        const label = (selected || 'link text').replace(/[\[\]\\]/g, '\\$&');
        const prefix = '['+label+'](';
        replace(start, end, prefix+'https://)', start+prefix.length, start+prefix.length+8);
      } else {
        const lineStart = input.value.lastIndexOf('\n', start-1)+1;
        const last = end > start && input.value[end-1] === '\n' ? end-1 : end;
        const next = input.value.indexOf('\n', last);
        const lineEnd = next === -1 ? input.value.length : next;
        const lines = input.value.slice(lineStart, lineEnd).split('\n');
        const pattern = command === 'quote' ? /^> ?/ : command === 'bullet' ? /^[-+*] / : /^\d+\. /;
        const removing = lines.some(line => line.trim()) && lines.every(line => !line.trim() || pattern.test(line));
        const value = lines.map((line, index) => removing ? line.replace(pattern, '') :
          (command === 'quote' ? '> ' : command === 'bullet' ? '- ' : (index+1)+'. ')+line).join('\n');
        replace(lineStart, lineEnd, value, start === end ? lineStart+value.length : lineStart, lineStart+value.length);
      }
    }
    buttons.forEach(button => {
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => format(button.dataset.reviewCommand));
    });
    toggle.addEventListener('click', () => {showPreview(!previewing); if (!previewing) input.focus({preventScroll:true});});
    input.addEventListener('keydown', event => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.isComposing) return;
      const command = {b:'bold',i:'italic'}[event.key.toLowerCase()];
      if (command) {event.preventDefault(); format(command);}
    });
    editor.closest('form').addEventListener('reset', () => showPreview(false));
    return {reset:() => showPreview(false)};
  }
  globalThis.PathosReview = Object.freeze({render,text,attach});
})();
