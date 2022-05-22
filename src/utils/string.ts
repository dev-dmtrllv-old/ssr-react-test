export const toSnakeCase = (str: string, delimiter: string = "-"): string => str.split("").map((l, i) => 
{
	if (i !== 0 && l === l.toUpperCase())
		return `${delimiter}${l}`;
	return l;
}).join("").toLowerCase();

export const capitalize = (str: string) => str[0].toUpperCase() + str.slice(1, str.length).toLowerCase();

export const hash = (str: string) =>
{
	let h = 0;
	for (let i = 0; i < str.length; i++)
	{
		const char = str.charCodeAt(i);
		h = (h << 5) - h + char;
	}
	return h;
};
