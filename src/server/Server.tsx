import { networkInterfaces } from "os";
import { AppConfig, ConfigAppInfo } from "./Config";
import express, { Application } from "express";
import { Renderer, RendererType } from "./Renderer";
import path from "path";

export class Server
{
	private static getDefaultHost = () =>
	{
		const nets = networkInterfaces();
		const results: any = {};

		for (const name of Object.keys(nets))
		{
			const n = nets[name];
			if (n)
			{
				for (const net of n)
				{
					if (net.family === "IPv4" && !net.internal)
					{
						if (!results[name])
							results[name] = [];
						results[name].push(net.address);
					}
				}
			}
		}

		if (Object.keys(results).length === 0)
			return "127.0.0.1"

		return results[Object.keys(results)[0]][0];
	}

	private static _instance: Server | null = null;

	public static async init<T extends Server = Server>(type: new () => T = Server as any): Promise<T>
	{
		this._instance = new type();
		return this._instance as T;
	}

	public static get(): Server
	{
		if (!this._instance)
			throw new Error("Server is not initialized yet!");
		return this._instance;
	}

	public readonly express: Application;
	public readonly host: string;
	public readonly port: number;
	public readonly appConfig: AppConfig;

	private readonly renderers: { [key: string]: RendererType<any>; } = {};

	protected constructor()
	{
		this.appConfig = new AppConfig();

		const { apps, server } = this.appConfig.data;

		this.host = server?.host || Server.getDefaultHost();
		this.port = server?.port || 8080;
		this.express = express();
		
		this.express.use(express.static(path.resolve(process.cwd(), "public")));
		
		let globalApp: string = "";

		for(const name in apps)
		{
			let url = apps[name].url;

			if(url === "/" || url === "*")
				globalApp = name;
			else
			{
				url = url.endsWith("*") ? url : `${url}*`;
				this.express.get(url, this.onAppRoute(name, apps[name]));
			}

			this.setRenderer(name, Renderer);
		}

		if(globalApp)
			this.express.get("*", this.onAppRoute(globalApp, apps[globalApp]));
	}

	protected onAppRoute(appName: string, appInfo: ConfigAppInfo)
	{
		const appComponents = this.appConfig.loadAppComponents();

		return (req: express.Request, res: express.Response) =>
		{
			const Component = appComponents[appName] as any;
			const renderer = new this.renderers[appName](Component, req, res);
			res.send(renderer.render(req, res));
		};
	}

	public setRenderer<T extends Renderer>(appName: string, rendererClass: RendererType<T>)
	{
		this.renderers[appName] = rendererClass;
	}

	public start(callback: () => any = () => {})
	{
		this.express.listen(this.port, this.host, () =>
		{
			console.log(`server is listening on http://${this.host}:${this.port}`);
			callback();
		});
	}
}

