/**
 * Lightweight Markdown → HTML converter.
 *
 * Handles the most common Markdown constructs using ES5-safe code.
 * Not a full CommonMark implementation — just enough for pleasant previews.
 */

// ===========================================================================
// Block-level parsing
// ===========================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function processInline(text: string): string {
  // Images: ![alt](src)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;" />');

  // Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Bold + italic: ***text***
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

  // Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.+?)_/g, '<em>$1</em>');

  // Strikethrough: ~~text~~
  text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Inline code: `code`
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  return text;
}

/** Convert a Markdown string to HTML. */
export function markdownToHtml(md: string): string {
  var lines = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  var html = '';
  var i = 0;
  var inCodeBlock = false;
  var codeBlockLang = '';
  var codeLines: string[] = [];
  var inList = false;
  var listType = ''; // 'ul' or 'ol'

  function closeList(): void {
    if (inList) {
      html += '</' + listType + '>';
      inList = false;
    }
  }

  while (i < lines.length) {
    var line = lines[i];

    // Fenced code block
    if (line.indexOf('```') === 0) {
      if (inCodeBlock) {
        // End code block
        html += '<pre><code class="language-' + escapeHtml(codeBlockLang) + '">' +
          escapeHtml(codeLines.join('\n')) + '</code></pre>';
        inCodeBlock = false;
        codeLines = [];
        codeBlockLang = '';
        i++;
        continue;
      } else {
        closeList();
        inCodeBlock = true;
        codeBlockLang = line.substring(3).trim();
        i++;
        continue;
      }
    }

    if (inCodeBlock) {
      codeLines.push(line);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(---|\*\*\*|___)$/.test(line.trim())) {
      closeList();
      html += '<hr />';
      i++;
      continue;
    }

    // Headings
    var headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      var level = headingMatch[1].length;
      html += '<h' + level + '>' + processInline(escapeHtml(headingMatch[2])) + '</h' + level + '>';
      i++;
      continue;
    }

    // Blockquote
    if (line.indexOf('> ') === 0 || line === '>') {
      closeList();
      var quoteLines: string[] = [];
      while (i < lines.length && (lines[i].indexOf('> ') === 0 || lines[i] === '>')) {
        quoteLines.push(lines[i].substring(2));
        i++;
      }
      html += '<blockquote>' + markdownToHtml(quoteLines.join('\n')) + '</blockquote>';
      continue;
    }

    // Unordered list
    var ulMatch = line.match(/^[\s]*[-*+]\s+(.*)/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        closeList();
        html += '<ul>';
        inList = true;
        listType = 'ul';
      }
      html += '<li>' + processInline(escapeHtml(ulMatch[1])) + '</li>';
      i++;
      continue;
    }

    // Ordered list
    var olMatch = line.match(/^[\s]*\d+\.\s+(.*)/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        closeList();
        html += '<ol>';
        inList = true;
        listType = 'ol';
      }
      html += '<li>' + processInline(escapeHtml(olMatch[1])) + '</li>';
      i++;
      continue;
    }

    // Close list if we reach a non-list line
    closeList();

    // Empty line → skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph — gather consecutive non-empty, non-special lines
    var paraLines: string[] = [];
    while (i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^#{1,6}\s/) &&
      lines[i].indexOf('```') !== 0 &&
      lines[i].indexOf('> ') !== 0 &&
      !lines[i].match(/^[\s]*[-*+]\s+/) &&
      !lines[i].match(/^[\s]*\d+\.\s+/) &&
      !/^(---|\*\*\*|___)$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    html += '<p>' + processInline(escapeHtml(paraLines.join('\n'))) + '</p>';
  }

  // Close any trailing code block
  if (inCodeBlock) {
    html += '<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>';
  }
  closeList();

  return html;
}
