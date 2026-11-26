export default function ({ types: t }) {
  return {
    visitor: {
      JSXOpeningElement(path, state) {
        const { node } = path;

        if (
          node.name.type === "JSXMemberExpression" ||
          node.name.name === "Fragment"
        )
          return;

        const hasDataSource = node.attributes.some(
          (attr) => t.isJSXAttribute(attr) && attr.name.name === "data-codexit-source",
        );
        if (hasDataSource) return;

        const location = node.loc;
        if (location) {
          const fileName = state.filename || "";
          const relativePath = fileName.split("/src/")[1] || fileName;

          node.attributes.push(
            t.jsxAttribute(
              t.jsxIdentifier("data-codexit-source"),
              t.stringLiteral(
                `${relativePath}:${location.start.line}:${location.start.column}`,
              ),
            ),
          );

          const hasDataComponent = node.attributes.some(
            (attr) =>
              t.isJSXAttribute(attr) && attr.name.name === "data-codexit-component",
          );
          if (!hasDataComponent) {
            const componentName = node.name.name || "tag";
            node.attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier("data-codexit-component"),
                t.stringLiteral(componentName),
              ),
            );
          }
        }
      },
    },
  };
}
