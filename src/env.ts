const isClient = new Function("try { return this === window; } catch(e) { return false; }");

if(isClient())
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
