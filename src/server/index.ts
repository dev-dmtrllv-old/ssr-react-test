if(module === undefined)
{
	window.env = {
		isClient: true,
		isServer: false
	};
}
else
{
	(global as any).env = {
		isClient: false,
		isServer: true
	};
}

export * from "./Server";
