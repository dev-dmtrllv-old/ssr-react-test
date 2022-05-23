import React from "react";
import ReactDOM from "react-dom/client";
import ReactDOMServer from "react-dom/server";
import { Async } from "./Async";
import { Html, HtmlProps } from "./Html";
import { IonAppContext } from "./IonAppContext";
import type { Manifest } from "./server/Manifest";

export namespace IonApp
{
	const clientFetcher: Fetcher = async (url, options) =>
	{
		const response = await fetch(url, options);
		const data = await response.text();
		try
		{
			return JSON.parse(data);
		}
		catch 
		{
			return data;
		}
	}

	export class Component<T extends React.FC<any>>
	{
		public readonly fc: T;
		public readonly options: Required<Options>;
		public readonly context: IonAppContext.Type;

		public constructor(fc: T, options: Options = {})
		{
			this.fc = fc;
			this.options = { ...defaultOptions, ...options };
			this.context = IonAppContext.create(env.isClient ? clientFetcher : async () => { }, false);
		}

		public wrap(context: IonAppContext.Type = this.context)
		{
			return (
				<IonAppContext.Provider context={context}>
					{React.createElement(this.fc)}
				</IonAppContext.Provider>
			);
		}

		public async resolve(fetcher: Fetcher, hydrate: boolean = false, ctx: Async.ContextType = this.context.async)
		{
			let context = IonAppContext.create(fetcher, !hydrate, hydrate, ctx);

			ReactDOMServer.renderToStaticMarkup(this.wrap(context));

			let newData = await Async.resolveComponents(context.async);

			while (Object.keys(newData).length > 0)
			{
				this.context.async.data = { ...this.context.async.data, ...newData };

				if (hydrate)
					this.context.async.cache = context.async.cache;

				context = IonAppContext.create(fetcher, !hydrate, hydrate, ctx);
				ReactDOMServer.renderToStaticMarkup(this.wrap(context));
				newData = await Async.resolveComponents(context.async);
			}

			if (hydrate)
				this.context.async.cache = context.async.cache;
		}

		protected async renderToString(appName: string, manifest: Manifest, fetcher: Fetcher)
		{
			await this.resolve(fetcher);

			const paths = Async.getDynamicPaths(this.context.async);

			const appString = ReactDOMServer.renderToString(this.wrap());

			return ReactDOMServer.renderToStaticMarkup(React.createElement(this.options.html, {
				appString,
				scripts: manifest.get(appName, paths, "js"),
				styles: manifest.get(appName, paths, "css"),
				ssrData: {
					async: this.context.async.resolvedDataStack
				}
			}));
		}

		public async render(appName: string, manifest: Manifest, fetcher: Fetcher)
		{
			return await new IonApp.Component(this.fc, this.options).renderToString(appName, manifest, fetcher);
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

			const ssrData = JSON.parse(decodeURIComponent(escape(atob((window as any).__SSR_DATA__))));

			this.context.async.resolvedDataStack = ssrData.async;

			await this.resolve(clientFetcher, true);

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

		if (!env.isServer)
			c.mount();

		return c;
	}

	type Options = {
		html?: React.FC<HtmlProps>;
	};

	export type Fetcher = (input: RequestInfo | URL, init?: RequestInit | undefined) => Promise<any>;
}
