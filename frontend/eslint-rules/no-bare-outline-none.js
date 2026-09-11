/**
 * `outline-none` без замены — запрещён.
 *
 * Кольцо фокуса по умолчанию даёт общее правило `:focus-visible` в
 * src/styles.css. Класс `outline-none` (и `outline-hidden`) его снимает: так
 * и задумано там, где элемент рисует свой признак фокуса — `ring`, фон,
 * рамку. Беда там, где снимают и ничего не ставят: с клавиатуры элемент
 * пропадает. 11.09 так нашлись поле поиска и аватар в шапке, а за ними ещё
 * 59 мест.
 *
 * Правило считает снятие законным, если рядом есть замена — класс с
 * вариантом фокуса (`focus:`, `focus-visible:`, `focus-within:`, в том числе
 * `group-…`/`peer-…`, и `has-[:focus…]`):
 *
 *   - в том же атрибуте `className`, во внешнем вызове cn/clsx/cva/twMerge
 *     или в той же константе;
 *   - или `focus-within:` на одной из четырёх обёрток выше — так у голого
 *     поля ввода кольцо рисует рамка вокруг него.
 *
 * Отдельно — инлайновый `outline: "none"` в объекте стилей. Инлайн
 * перебивает любой класс, заменить его рядом нечем, поэтому он запрещён
 * всегда.
 *
 * Если элементу кольцо не нужно вовсе (контейнер, который получает фокус
 * программно, с tabIndex=-1), — `eslint-disable-next-line` с причиной.
 */

const REMOVES = /(?:^|\s)(?:[\w\-[\]:&]+:)?outline-(?:none|hidden)(?=\s|$)/;
// Сами снимающие классы из контекста вырезаются до поиска замены:
// иначе `focus:outline-none` засчитал бы себя собственной заменой.
const REMOVAL_TOKENS = /(^|[\s"'`])(?:[\w\-[\]:&]+:)?outline-(?:none|hidden)(?=[\s"'`]|$)/g;
const REPLACES = /(?:^|[\s:"'`])(?:group-|peer-)?focus(?:-visible|-within)?:|has-\[:focus/;
const WITHIN = /(?:^|[\s:"'`])(?:group-|peer-)?focus-within:|has-\[:focus/;
const CLASS_CALLS = new Set(["cn", "clsx", "cva", "twMerge", "classNames"]);
const WRAPPER_DEPTH = 4;

const MESSAGE =
  "outline-none снимает кольцо фокуса без замены. Уберите класс — кольцо даст общее правило :focus-visible в styles.css — или поставьте рядом свою замену (focus-visible:…, focus:…, focus-within: на обёртке).";
const INLINE_MESSAGE =
  "Инлайновый outline: none перебивает любое кольцо фокуса. Уберите его из style — кольцо даст общее правило :focus-visible в styles.css.";

function isClassCall(node) {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    CLASS_CALLS.has(node.callee.name)
  );
}

/** Узел, в пределах которого ищется замена: атрибут, вызов cn/cva или константа. */
function classContext(node) {
  let outerCall = null;
  let declarator = null;
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (cur.type === "JSXAttribute") return cur;
    if (isClassCall(cur)) outerCall = cur;
    if (cur.type === "VariableDeclarator" && !declarator) declarator = cur;
    if (cur.type === "Program" || /Statement$/.test(cur.type)) break;
  }
  return outerCall ?? declarator ?? node;
}

/** Есть ли `focus-within:` на одной из обёрток элемента, которому принадлежит атрибут. */
function wrapperHasFocusWithin(attr, sourceCode) {
  let el = attr.parent && attr.parent.parent; // JSXOpeningElement → JSXElement
  for (let depth = 0; depth < WRAPPER_DEPTH && el; depth++) {
    el = el.parent;
    while (el && el.type !== "JSXElement") el = el.parent;
    if (!el) return false;
    const cls = el.openingElement.attributes.find(
      (a) => a.type === "JSXAttribute" && a.name && a.name.name === "className",
    );
    if (cls && WITHIN.test(sourceCode.getText(cls))) return true;
  }
  return false;
}

function isNone(value) {
  return value === "none" || value === 0 || value === "0";
}

export default {
  meta: {
    type: "problem",
    docs: { description: "Запрещает outline-none без сопутствующего признака фокуса" },
    schema: [],
    messages: { bare: MESSAGE, inline: INLINE_MESSAGE },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function check(node, text) {
      if (!REMOVES.test(text)) return;
      const scope = classContext(node);
      if (REPLACES.test(sourceCode.getText(scope).replace(REMOVAL_TOKENS, "$1"))) return;
      if (scope.type === "JSXAttribute" && wrapperHasFocusWithin(scope, sourceCode)) return;
      context.report({ node, messageId: "bare" });
    }

    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
      Property(node) {
        const key = node.key.type === "Identifier" ? node.key.name : node.key.value;
        if (key !== "outline" && key !== "outlineStyle") return;
        if (node.value.type === "Literal" && isNone(node.value.value)) {
          context.report({ node, messageId: "inline" });
        }
      },
    };
  },
};
