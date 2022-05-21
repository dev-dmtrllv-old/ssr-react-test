import React from "react";
import ReactDOM from "react-dom/client";
import ReactDOMServer from "react-dom/server";
import { Html, HtmlProps } from "./Html";

export namespace IonApp
{
	export class Resolver
	{

	}

	export const isServer = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node !== "undefined";

	const defaultOptions: Required<Options> = {
		html: Html
	};

	export const create = (fc: React.FC<any>, options: Options = {}): IonAppExport =>
	{
		const { html } = { ...defaultOptions, ...options };

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
			return null;
		}

		return () => 
		{
			const appString = ReactDOMServer.renderToString(React.createElement(fc));
			return ReactDOMServer.renderToStaticMarkup(React.createElement(html, { appString, scripts: ["js/vendors.bundle.js","js/App.bundle.js"] }));
		};
	}
}

type IonAppExport = null | (() => string);

type Options = {
	html?: React.FC<HtmlProps>;
};
