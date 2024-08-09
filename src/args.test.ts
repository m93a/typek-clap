import { assertEquals } from "@typek/typek";
import { parseArguments } from "./args.ts";

Deno.test("parseArguments", () => {
  Deno.test("empty", () => {
    const empty = parseArguments([]);
    assertEquals(empty.raw, []);
    assertEquals(empty.parsed, []);
    assertEquals(empty.has("-f"), false);
    assertEquals(empty.has("--foo"), false);
    assertEquals(empty.has("--foo", "-f"), false);
    assertEquals(empty.get("-f"), undefined);
    assertEquals(empty.get("--foo"), undefined);
    assertEquals(empty.get("--foo", "-f"), undefined);
  });

  Deno.test("hello world", () => {
    const hello = parseArguments(["--hello", "world", "-aBc"]);
    assertEquals(hello.raw, ["--hello", "world", "-aBc"]);
    assertEquals(hello.parsed, [
      { long: "--hello" },
      { text: "world" },
      { short: "-aBc" },
    ]);
    assertEquals(hello.has("-a"), true);
    assertEquals(hello.has("--all", "-a"), true);
    assertEquals(hello.has("-B"), true);
    assertEquals(hello.has("-b"), false);
    assertEquals(hello.has("--hello"), true);
    assertEquals(hello.get("--hello"), "world");
    assertEquals(hello.get("-a"), "Bc");
  });

  Deno.test("calculator", () => {
    const calc = parseArguments(["5", "--add", "3", "-m2", "--divide=4"]);
    assertEquals(calc.get("--add", "-a"), "3");
    assertEquals(calc.get("--multiply", "-m"), "2");
    assertEquals(calc.get("--divide", "-d"), "4");
  });
});
