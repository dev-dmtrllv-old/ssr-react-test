import express, { Application, NextFunction } from "express";
import path from "path";
import session from "express-session";
import cookieParser from "cookie-parser";

import { AppConfig, ConfigAppInfo } from "./Config";
import { Manifest } from "./Manifest";
import { Api, ApiImplementation, ApiManifest } from "./Api";
import { Client } from "../Client";
import { IonApp } from "../IonApp";
import { Session } from "./ApiSession";
import MySQLSessionStore from "express-mysql-session";
import { cloneError } from "../utils/object";
import { Renderer } from "./Renderer";
import { networkInterfaces } from "os";
import SSRData from "../SSRData";

const MySQLStore = MySQLSessionStore(session);

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

	public readonly express: Application;
	public readonly host: string;
	public readonly port: number;
	public readonly appConfig: AppConfig;
	public readonly appsSSRData: Readonly<SSRData["apps"]>;

	private _apiManifest: Readonly<ApiManifest> = {
		routes: {},
		basePath: "/api"
	};

	public get apiManifest() { return this._apiManifest; }

	public api: ApiImplementation<any> = {
		api: {},
		flat: {}
	};

	private _apiFallback: ApiFallback = (req, res, next) => 
	{
		res.send(`Could not ${req.method} Api ${req.originalUrl}!`);
	};

	public readonly manifest: Manifest = new Manifest();

	public constructor(config: ServerConfig = {})
	{
		this.appConfig = new AppConfig();

		const { server, apps } = this.appConfig.data;

		const appsMap: SSRData["apps"] = {};

		Object.keys(apps).forEach(name => 
		{
			const { url, title } = apps[name];
			appsMap[url] = title || name;
		});

		this.appsSSRData = appsMap;

		this.host = server?.host || Server.getDefaultHost();
		this.port = server?.port || 8080;

		this.express = express();
		this.express.use(express.urlencoded({ extended: true }));
		this.express.use(express.json());
		this.express.use(cookieParser());
		this.express.use(session({
			store: new MySQLStore({
				host: "localhost",
				port: 3306,
				user: "root",
				password: "NovaEnMomoZijnAwesome",
				database: "test"
			}),
			name: "SID",
			resave: false,
			secret: "secret",
			saveUninitialized: false,
			...(config.session || {}),
		}));

		this.express.use(express.static(path.resolve(process.cwd(), "public")));
	}

	public setApi(api: ApiImplementation<any>, apiFallback?: ApiFallback)
	{
		const apiBase = this.appConfig.serverApiPath;
		this.api = api;
		this._apiManifest = Api.createManifest(apiBase, this.api.flat);

		Client.updateApiForServer(apiBase, api);

		if (apiFallback)
			this._apiFallback = apiFallback;
	}

	protected onAppRoute(appName: string, appUrl: string, component: any, appInfo: ConfigAppInfo)
	{
		return async (req: express.Request, res: express.Response) =>
		{
			const renderer = new Renderer(this, appUrl, component, req, res);
			await renderer.render(appName, appInfo.title || "");
		};
	}

	public start(callback: () => any = () => { })
	{
		const { apps } = this.appConfig.data;

		const { flat } = this.api;

		if (Object.keys(flat).length > 0)
		{
			const apiBasePath = this.appConfig.serverApiPath;

			for (const path in flat)
			{
				const ApiClass = flat[path][0];
				if (ApiClass)
				{
					flat[path][1].forEach(m => 
					{
						console.log(`Set [${m.toUpperCase()}] api with path ${apiBasePath + path}`);
						this.express[m](apiBasePath + path, async (req, res, next) => 
						{
							const session: any = new Session(req);

							const api = new ApiClass(session);

							try
							{
								const data = await api[m]!(m === "get" ? req.query : req.body);
								if (req.session)
									req.session.save(() => res.json({ data }));
								else
									res.json({ data });
							}
							catch (e)
							{
								if (req.session)
									req.session.save(() => res.json({ error: cloneError(e) }));
								else
									res.json({ error: cloneError(e) });
							}
						});
					});
				}
			}

			this.express.use(apiBasePath, this._apiFallback);
		}

		const appComponents = this.appConfig.loadAppComponents(this.api);

		let globalApp: string = "";

		for (const name in apps)
		{
			let url = apps[name].url;

			if (url === "/" || url === "*")
			{
				globalApp = name;
			}
			else
			{
				url = url.endsWith("*") ? url : `${url}*`;
				console.log(`Set app ${name} with path ${url}`);
				this.express.get(url, this.onAppRoute(name, apps[name].url, appComponents[name], apps[name]));
			}
		}

		if (globalApp)
		{
			console.log(`Set app ${globalApp} with path /*`);
			this.express.get("/*", this.onAppRoute(globalApp, apps[globalApp].url, appComponents[globalApp], apps[globalApp]));
		}

		this.express.listen(this.port, this.host, () =>
		{
			console.log(`server is listening on http://${this.host}:${this.port}`);
			callback();
		});
	}
}

type ApiFallback = (req: express.Request, res: express.Response, next: NextFunction) => any;

type ServerConfig = {
	session?: Partial<SessionConfig>;
};

type SessionConfig = session.SessionOptions;
