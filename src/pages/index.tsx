"use client";
import { useState, useEffect, useRef, KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { Inter } from "next/font/google";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Resizable } from "re-resizable";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

const JSONTree = dynamic(
  () => import("react-json-tree").then((mod) => mod.JSONTree),
  {
    ssr: false,
  }
);

const inter = Inter({ subsets: ["latin"] });

const customJsonTreeTheme = {
  scheme: "custom",
  author: "custom",
  base00: "#ffffff",
  base01: "#f5f5f5",
  base02: "#e0e0e0",
  base03: "#969896",
  base04: "#666666",
  base05: "#333333",
  base06: "#252525",
  base07: "#000000",
  base08: "#d32f2f",
  base09: "#f4511e",
  base0A: "#f9a825",
  base0B: "#4caf50",
  base0C: "#00bcd4",
  base0D: "#2196f3",
  base0E: "#9c27b0",
  base0F: "#795548",
};

// Default sizes for resizable panels
const DEFAULT_MAIN_PANEL_HEIGHT = "70%";
const DEFAULT_JSON_INPUT_WIDTH = "70%";
const MIN_MAIN_PANEL_HEIGHT = "20%";
const MAX_MAIN_PANEL_HEIGHT = "80%";
const MIN_JSON_INPUT_WIDTH = "20%";
const MAX_JSON_INPUT_WIDTH = "80%";

export default function Home() {
  const [jsonContent, setJsonContent] = useState('{\n  "example": "data"\n}');
  const [jsonError, setJsonError] = useState("");
  const [query, setQuery] = useState("");
  const [queryHistory, setQueryHistory] = useState<
    Array<{ query: string; result: string }>
  >([]);
  const [parsedJson, setParsedJson] = useState<any>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    function handleResize() {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    try {
      const parsed = JSON.parse(jsonContent);
      setParsedJson(parsed);
      setJsonError("");
      updateCompletionItems(parsed);
      // Auto-format the JSON input
      const formattedJson = JSON.stringify(parsed, null, 2);
      setJsonContent(formattedJson);
    } catch (error) {
      if (error instanceof Error) {
        setJsonError(error.message);
      } else {
        setJsonError("An unknown error occurred");
      }
      setParsedJson(null);
    }
  }, [jsonContent]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement;
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [queryHistory]);

  const handleJsonChange = (value: string | undefined) => {
    if (value !== undefined) {
      setJsonContent(value);
    }
  };

  const handleQueryChange = (value: string | undefined) => {
    if (value !== undefined) {
      setQuery(value);
    }
  };

  const executeQuery = (inpQuery?: string) => {
    let queryToExecute = inpQuery || query;
    if (!queryToExecute.trim()) return; // Prevent executing empty queries

    try {
      const result = evaluateJsonPath(parsedJson, queryToExecute);
      const resultString = JSON.stringify(result, null, 2);
      setQueryHistory((prev) => [
        ...prev,
        { query: queryToExecute, result: resultString },
      ]);
    } catch (error) {
      let errorMessage = "An unknown error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setQueryHistory((prev) => [
        ...prev,
        { query: queryToExecute, result: `Error: ${errorMessage}` },
      ]);
    }
    setQuery("");
  };

  const evaluateJsonPath = (obj: any, path: string): any => {
    const parts = path.split(".");
    let result = obj;
    for (let part of parts) {
      if (part === "$") continue;
      if (part.includes("[") && part.includes("]")) {
        const [arrayName, indexStr] = part.split("[");
        const index = parseInt(indexStr.replace("]", ""));
        result = result[arrayName][index];
      } else {
        result = result[part];
      }
      if (result === undefined) return undefined;
    }
    return result;
  };

  const updateCompletionItems = (json: any) => {
    if (monacoRef.current && editorRef.current) {
      const monaco = monacoRef.current;
      const editor = editorRef.current;

      const getCompletionItems = (obj: any, prefix: string = "$"): any[] => {
        return Object.keys(obj).flatMap((key) => {
          const fullPath = `${prefix}.${key}`;
          const suggestions = [
            {
              label: fullPath,
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: fullPath,
              range: {
                startLineNumber: 1,
                endLineNumber: 1,
                startColumn: 1,
                endColumn: 1,
              },
            },
          ];

          if (typeof obj[key] === "object" && obj[key] !== null) {
            return [...suggestions, ...getCompletionItems(obj[key], fullPath)];
          }

          return suggestions;
        });
      };

      monaco.languages.registerCompletionItemProvider("plaintext", {
        provideCompletionItems: (model: any, position: any) => {
          const suggestions = getCompletionItems(json);
          return {
            suggestions: suggestions,
          };
        },
      });
    }
  };

  const handleQueryKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      executeQuery();
    }
  };

  return (
    <main
      className={`flex h-screen flex-col ${inter.className} bg-white text-black`}
    >
      <div className="flex flex-col h-full">
        <Resizable
          defaultSize={{
            width: "100%",
            height: DEFAULT_MAIN_PANEL_HEIGHT,
          }}
          minHeight={MIN_MAIN_PANEL_HEIGHT}
          maxHeight={MAX_MAIN_PANEL_HEIGHT}
          enable={{ bottom: true }}
        >
          <div className="flex h-full">
            <Resizable
              defaultSize={{
                width: DEFAULT_JSON_INPUT_WIDTH,
                height: "100%",
              }}
              minWidth={MIN_JSON_INPUT_WIDTH}
              maxWidth={MAX_JSON_INPUT_WIDTH}
              enable={{ right: true }}
            >
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>JSON Input</CardTitle>
                </CardHeader>
                <CardContent className="h-[calc(100%-4rem)]">
                  <MonacoEditor
                    height="100%"
                    language="json"
                    theme="vs-light"
                    value={jsonContent}
                    onChange={handleJsonChange}
                    options={{
                      minimap: { enabled: false },
                      formatOnPaste: true,
                      formatOnType: true,
                      wordWrap: "on",
                      wrappingStrategy: "advanced",
                    }}
                  />
                </CardContent>
              </Card>
            </Resizable>
            <div className="flex-grow h-full">
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>JSON Tree View</CardTitle>
                </CardHeader>
                <CardContent className="h-[calc(100%-4rem)]">
                  <ScrollArea className="h-full">
                    {parsedJson && (
                      <div className="font-mono text-sm">
                        <JSONTree
                          data={parsedJson}
                          theme={customJsonTreeTheme}
                        />
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </Resizable>
        <div className="flex-grow">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Query Console</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col">
              <ScrollArea className="h-[calc(100% - 4rem)]" ref={scrollAreaRef}>
                <div className="p-2">
                  {queryHistory.length > 0 ? (
                    queryHistory.map((item, index) => (
                      <div key={index} className="mb-2">
                        <div className="font-bold text-blue-600 font-mono">{`> ${item.query}`}</div>
                        <pre className="bg-gray-100 p-2 rounded mt-1 text-green-700 font-mono text-sm whitespace-pre-wrap">
                          {item.result}
                        </pre>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500">
                      No queries executed yet.
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="flex items-center" onKeyDown={handleQueryKeyDown}>
                <div className="flex-grow mr-2" style={{ height: "38px" }}>
                  <MonacoEditor
                    height="100%"
                    language="plaintext"
                    theme="vs-light"
                    value={query}
                    onChange={handleQueryChange}
                    options={{
                      minimap: { enabled: false },
                      lineNumbers: "off",
                      glyphMargin: false,
                      folding: false,
                      lineDecorationsWidth: 0,
                      lineNumbersMinChars: 0,
                      wordWrap: "on",
                      wrappingStrategy: "advanced",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                    onMount={(editor, monaco) => {
                      editorRef.current = editor;
                      monacoRef.current = monaco;
                      updateCompletionItems(parsedJson);
                    }}
                  />
                </div>
                <Button onClick={() => executeQuery()}>Execute</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
