import React from "react";
import { Async } from "./Async";
import { ErrorHtml, Html, HtmlErrorProps, HtmlProps } from "./Html";
import { Renderer } from "./Renderer";
import { RedirectCallback } from "./Router";

export class IonApp
{
	private static defaultConfig: Readonly<Required<AppConfig>> = {
		ErrorHtml: ErrorHtml,
		Html: Html
	};

	public static readonly create = (fc: React.FC<any>, config?: AppConfig): IonApp =>
	{
		const app = new IonApp(fc, { ...IonApp.defaultConfig, ...config });
		if (env.isClient)
			app.renderClient();
		return app;
	}

	private readonly fc: React.FC<any>;
	public readonly appConfig: Readonly<Required<AppConfig>>;
	private readonly renderer: Renderer;

	protected constructor(fc: React.FC<any>, appConfig: AppConfig)
	{
		this.fc = fc;
		this.appConfig = { ...IonApp.defaultConfig, ...appConfig };
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

	public readonly renderServer = async (url: string, title: string, onRedirect: RedirectCallback): Promise<ServerRenderResult> =>
	{
		const app = new IonApp(this.fc, this.appConfig);

		const renderResult = await app.renderer.render(url, title, onRedirect, );

		if(renderResult.didRedirect)
			return { didRedirect: true };

		return { ...this.appConfig, ...renderResult, didRedirect: false };
	}
}

type ServerRenderResult = (Readonly<Required<AppConfig>> & {
	appString: string,
	asyncStack: Async.ContextType["renderStack"];
	title: string;
	didRedirect: false;
}) | {
	didRedirect: true;
} ;

export type AppConfig = {
	Html?: React.FC<HtmlProps>;
	ErrorHtml?: React.FC<HtmlErrorProps>;
};
