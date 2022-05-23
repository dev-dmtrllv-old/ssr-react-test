import React from "react";
import ReactDOM from "react-dom/client";
import ReactDOMServer from "react-dom/server";
import { Async } from "./Async";
import { Html, HtmlProps } from "./Html";
import { IonAppContext } from "./IonAppContext";
import type { Manifest } from "./server/Manifest";

export namespace IonApp
{
	export class Component<T extends React.FC<any>>
	{
		public readonly fc: T;
		public readonly options: Required<Options>;
		public readonly context: IonAppContext.Type;

		public constructor(fc: T, options: Options = {})
		{
			this.fc = fc;
			this.options = { ...defaultOptions, ...options };
			this.context = IonAppContext.create(false);
		}

		public wrap(context: IonAppContext.Type = this.context)
		{
			return (
				<IonAppContext.Provider context={context}>
					{React.createElement(this.fc)}
				</IonAppContext.Provider>
			);
		}

		public async resolve(hydrate: boolean = false, ctx: Async.ContextType = this.context.async)
		{
			let context = IonAppContext.create(!hydrate, hydrate, ctx);

			ReactDOMServer.renderToStaticMarkup(this.wrap(context));

			let newData = await Async.resolveComponents(context.async);

			while (Object.keys(newData).length > 0)
			{
				this.context.async.data = { ...this.context.async.data, ...newData };

				console.log(context.async.cache);

				if (hydrate)
					this.context.async.cache = context.async.cache;

				context = IonAppContext.create(!hydrate, hydrate, ctx);
				ReactDOMServer.renderToStaticMarkup(this.wrap(context));
				newData = await Async.resolveComponents(context.async);
			}

			if (hydrate)
				this.context.async.cache = context.async.cache;
		}

		protected async renderToString(appName: string, manifest: Manifest)
		{
			await this.resolve();

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

		public async render(appName: string, manifest: Manifest)
		{
			return await new IonApp.Component(this.fc, this.options).renderToString(appName, manifest);
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

			this.context.async.resolvedDataStack = (window as any).__SSR_DATA__.async;

			await this.resolve(true);

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
}
