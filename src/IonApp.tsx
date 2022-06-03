import React from "react";
import ReactDOM from "react-dom/client";
import ReactDOMServer from "react-dom/server";
// import { Async } from "./Async";
import { Client } from "./Client";
import { ErrorHtml, Html, HtmlErrorProps, HtmlProps } from "./Html";
import { Renderer } from "./Renderer";
// import { RedirectCallback } from "./Router";
import type { ApiImplementation, ApiManifest, ApiScheme } from "./server";
import type { Manifest } from "./server/Manifest";
import SSRData, { getSSRData } from "./SSRData";
import { Static } from "./Static";
import { CancelToken } from "./utils";
import { cloneError } from "./utils/object";

export class IonApp
{
	private static defaultConfig: Required<AppConfig> = {

	};

	public static readonly create = (fc: React.FC<any>, config?: AppConfig): IonApp =>
	{
		const app = new IonApp(fc, { ...IonApp.defaultConfig, ...config });
		if (env.isClient)
			app.renderClient();
		return app;
	}

	private readonly fc: React.FC<any>;
	public readonly appConfig: Readonly<AppConfig>;
	private readonly renderer: Renderer;

	protected constructor(fc: React.FC<any>, appConfig: AppConfig)
	{
		this.fc = fc;
		this.appConfig = appConfig;
		this.renderer = new Renderer(fc, {});
	}

	public readonly renderClient = async () =>
	{
		let rootEl = document.getElementById("root");
		
		if(!rootEl)
		{
			rootEl = document.createElement("div");
			rootEl.id = "root";
			document.body.appendChild(rootEl);
		}
	
		return this.renderer.hydrate(rootEl);
	}

	public readonly renderServer = async () =>
	{
		const app = new IonApp(this.fc, this.appConfig);

		const appString = await app.renderer.render();

		return appString;
	}
}

export type AppConfig = {

};
