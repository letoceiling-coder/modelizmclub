import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-bare-outline-none.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run("no-bare-outline-none", rule, {
  valid: [
    // своё кольцо рядом
    '<input className="w-full outline-none focus-visible:ring-2" />',
    '<button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" />',
    // признак фокуса — фон, как у пунктов меню
    'const item = cva("rounded-sm outline-none focus:bg-accent");',
    // замена в другом аргументе того же cn
    '<button className={cn("grid outline-none", "focus-visible:outline-2")} />',
    // кольцо на обёртке
    '<label className="rounded border focus-within:ring-2"><span><input className="outline-none" /></span></label>',
    '<div className="has-[:focus-visible]:ring-2"><input className="outline-none" /></div>',
    // снятия нет вовсе
    '<button className="rounded-full hover:bg-muted" />',
    'const s = { outline: "2px solid red" };',
  ],
  invalid: [
    {
      code: '<input className="w-full text-[14px] outline-none" />',
      errors: [{ messageId: "bare" }],
    },
    {
      code: '<button className={cn("grid outline-none", extra)} />',
      errors: [{ messageId: "bare" }],
    },
    { code: 'const cls = "h-10 rounded outline-none";', errors: [{ messageId: "bare" }] },
    { code: "<input className={`a ${b} outline-none`} />", errors: [{ messageId: "bare" }] },
    // обёртка есть, но без focus-within
    {
      code: '<div className="rounded border"><input className="outline-none" /></div>',
      errors: [{ messageId: "bare" }],
    },
    // снятие под вариантом фокуса — всё равно снятие
    { code: '<button className="focus:outline-none" />', errors: [{ messageId: "bare" }] },
    { code: '<input style={{ outline: "none" }} />', errors: [{ messageId: "inline" }] },
    { code: "const s = { outlineStyle: 'none' };", errors: [{ messageId: "inline" }] },
  ],
});
