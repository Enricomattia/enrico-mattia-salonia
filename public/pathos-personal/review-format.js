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
  function tokens(value) {return markdown ? markdown.parse(String(value ?? ''), {}) : [];}
  function attach(editor) {
    if (markdown && globalThis.PathosReviewEditor) return globalThis.PathosReviewEditor.attach(editor);
    // Keep the existing string editable if a bundled asset fails to load.
    editor.querySelector('textarea').hidden = false;
    editor.querySelector('.review-surface').hidden = true;
    editor.querySelectorAll('[data-review-command]').forEach(button => button.disabled = true);
    return {reset() {}};
  }
  globalThis.PathosReview = Object.freeze({render,text,tokens,attach});
})();
