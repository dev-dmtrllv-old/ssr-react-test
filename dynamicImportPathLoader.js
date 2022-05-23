const importRegex = /import\("/gmi;
const { existsSync } = require("fs");
const path = require("path");

module.exports = function dynamicImportResolver(content)
{
	const options = this.getOptions();
	const isTs = this.resourcePath.endsWith(".ts") || this.resourcePath.endsWith(".tsx");

	let found;

	while (found = importRegex.exec(content))
	{
		const s = found.index + 8;
		let i = s;

		while (content[i] != ")")
			i++;

		const p = content.substring(s - 1, i);
		const importString = `import(${p})`;

		const root = options.root.replaceAll("\\", "/");

		const filePath = path.join(path.dirname(this.resourcePath), p.substring(1, p.length - 1));

		const fileName = filePath.replaceAll("\\", "/").replace(root, ".");

		content = content.replace(importString, `(${importString}.then((m${isTs ? ": any" : ""}) => { m.__IMPORT_PATH__ = "${fileName}"; return m; }))`);
	}

	return content;
};
