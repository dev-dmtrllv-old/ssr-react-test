export const isEmpty = (obj: { [key: string]: any }) => (typeof obj === "object" && !Array.isArray(obj)) ? (Object.keys(obj).length === 0) : false;

export const serialize = (obj: { [key: string]: any }) =>
{
	let parts: string[] = [];
	for (const p in obj)
		if (obj.hasOwnProperty(p))
			parts.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
	return parts.join("&");
}

export const deserialize = (str: string) =>
{
	const o: any = {};
	str.split("&").forEach(p => 
	{
		const [k, v] = p.split("=");
		o[k] = v;
	});
	return o;
}

export const toArray = (o: { [key: string]: any }): any[] =>
{
	const props: any = [];

	for (const key in o)
		props.push(o[key]);

	return props;
}

export const cloneError = <T extends {}>(error: Error): Error & T =>
{
	return {
		...error,
		stack: error.stack || "",
		name: error.name,
		message: error.message,
	} as Error & T;
}

export const equals = <T>(a: T, b: T) =>
{
	const type = typeof a;

	if (type !== typeof b)
		return false;

	if (Array.isArray(a))
	{
		if (!Array.isArray(b))
			return false;

		const l = a.length;

		if (l !== b.length)
			return false;

		for (let i = 0; i < l; i++)
			if (!equals(a[i], b[i]))
				return false;

		return true;
	}

	switch (type)
	{
		case "bigint":
		case "boolean":
		case "number":
		case "string":
		case "symbol":
			return a === b;
		case "function":
			return (a as any).toString() === (b as any).toString();
		case "undefined":
			return true;
		case "object":
			{
				const keysA = Object.keys(a);
				const keysB = Object.keys(b);
				if(!equals(keysA, keysB))
					return false;
				
				for(const key of keysA)
					if(!equals(a[key], b[key]))
						return false;
				
				return true;
			}
	}
} 