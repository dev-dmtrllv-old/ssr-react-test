import { networkInterfaces } from "os";
import { AppComponents, Config, ConfigAppInfo, getAppComponents, getConfig } from "./Config";
import express, { Application } from "express";
import ReactDOMServer from "react-dom/server";
import React from "react";

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

	public static async init()
	{
		const appComponents = await getAppComponents();
		this._instance = new Server(appComponents);
		return this._instance;
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
	public readonly appComponents: Readonly<AppComponents>;

	private constructor(appComponents: AppComponents)
	{
		const { server, apps } = getConfig();
		this.host = server?.host || Server.getDefaultHost();
		this.port = server?.port || 8080;
		this.express = express();

		this.appComponents = appComponents;

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
		}

		if(globalApp)
			this.express.get("*", this.onAppRoute(globalApp, apps[globalApp]));
	}

	private onAppRoute(appName: string, appInfo: ConfigAppInfo)
	{
		return (req: express.Request, res: express.Response) =>
		{
			const Component = this.appComponents[appName];
			res.send(ReactDOMServer.renderToStaticMarkup(React.createElement(Component)))
		};
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
