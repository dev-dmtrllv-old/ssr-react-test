import React from "react";
import ReactDOM from "react-dom/client";
import ReactDOMServer from "react-dom/server";

export namespace Ion
{
	export const isServer = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node !== "undefined";

	export const createApp = (fc: React.FC<any>): IonAppComponent =>
	{
		
		const c: IonAppComponent = {
			render: () =>
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
			},
			renderToString: () => ReactDOMServer.renderToString(React.createElement(fc)),
			resolve: () => {}
		};
		
		if (!isServer)
			c.render();

		return c;
	}
}

export type IonAppComponent = {
	render: () => void;
	resolve: () => void;
	renderToString: () => string;
};
