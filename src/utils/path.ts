export const join = (...parts: string[]) =>
{
	let pathParts: string[] = [];

	for (let p of parts)
	{
		if (p.startsWith("/"))
			p = p.substring(1, p.length);

		if (p.endsWith("/"))
			p = p.substring(0, p.length - 1);

		if(p)
			pathParts.push(p);
	}

	if (pathParts.length === 0)
		return "/";

	return (parts[0].startsWith("/") ? "/" : "") + pathParts.join("/");
}

export const toURLQuery = (o: { [key: string]: any }) => Object.keys(o).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(o[k])}`).join("&");
