import React from "react";
import ReactDOM from "react-dom/client";

export const ionTest = () => "ion-test";

const isServer = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node !== "undefined";

export const createApp = (fc: React.FC<any>) =>
{
	if (!isServer)
	{
		const rootID = "root";
		const initRoot = () =>
		{
			let rootElement = document.getElementById(rootID);
			if (!rootElement)
			{
				rootElement = document.createElement("div");
				rootElement.id = rootID;
				document.body.appendChild(rootElement);
			}
			return rootElement;
		};
		const rootElement = initRoot();
		const root = ReactDOM.createRoot(rootElement);
		root.render(React.createElement(fc));
	}
	else
	{
		(global as any).umdApp = fc;
	}


	return fc;
}
