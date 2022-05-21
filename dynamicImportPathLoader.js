const importRegex = /import\("/gmi;

module.exports = function dynamicImportResolver(content)
{
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

		content = content.replace(importString, `(${importString}.then((m${isTs ? ": any" : ""}) => { m.__IMPORT_PATH__ = ${p}; return m; }))`);
	}

	return content;
};
