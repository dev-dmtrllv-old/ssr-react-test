import React from "react";
import ReactDOM from "react-dom/client";
import ReactDOMServer from "react-dom/server";
import { Async } from "./Async";
import { Html, HtmlProps } from "./Html";
import { IonAppContext } from "./IonAppContext";

export namespace IonApp
{
	const isServer = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node !== "undefined";

	export class Component<T extends React.FC<any>>
	{
		public readonly fc: T;
		public readonly options: Required<Options>;
		public readonly context: IonAppContext.Type;

		public constructor(fc: T, options: Options = {})
		{
			this.fc = fc;
			this.options = { ...defaultOptions, ...options };
			this.context = IonAppContext.create(isServer, false);
		}

		public wrap(context: IonAppContext.Type = this.context)
		{
			return (
				<IonAppContext.Provider context={context}>
					{React.createElement(this.fc)}
				</IonAppContext.Provider>
			);
		}

		public async resolve(): Promise<string>
		{
			let context = IonAppContext.create(isServer, true, false, { ...this.context.async.data });

			ReactDOMServer.renderToStaticMarkup(this.wrap(context));

			let newData = await Async.resolveComponents(context.async);

			while (Object.keys(newData).length > 0)
			{
				this.context.async.data = { ...this.context.async.data, ...newData };
				context = IonAppContext.create(isServer, true, false, { ...this.context.async.data });
				ReactDOMServer.renderToStaticMarkup(this.wrap(context));
				newData = await Async.resolveComponents(context.async);
			}

			return ReactDOMServer.renderToStaticMarkup(this.wrap());
		}

		public async hydrate()
		{
			let context = IonAppContext.create(isServer, false, true, (window as any).__SSR_DATA__.async);

			ReactDOMServer.renderToStaticMarkup(this.wrap(context));

			this.context.async.data = { ...context.async.data };
		}

		public async render()
		{
			const appString = await this.resolve();

			return ReactDOMServer.renderToStaticMarkup(React.createElement(this.options.html, {
				appString,
				scripts: [
					"js/runtime.bundle.js",
					"js/vendors.bundle.js",
					"js/App.bundle.js"
				],
				ssrData: {
					async: this.context.async.resolvedDataStack
				}
			}));
		}

		public async mount()
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

			await this.hydrate();

			const rootElement = initRoot();
			ReactDOM.hydrateRoot(rootElement, this.wrap());
		}
	}

	const defaultOptions: Required<Options> = {
		html: Html
	};

	export const create = <T extends React.FC<any>>(fc: T, options: Options = {}): Component<T> =>
	{
		const c = new Component(fc, options);

		if (!isServer)
			c.mount();

		return c;
	}

	type Options = {
		html?: React.FC<HtmlProps>;
	};
}
