import { Request, Response } from "express";
import { IonAppComponent } from "./Config";
import type * as ReactType from "react";
import type * as ReactDOMServerType from "react-dom/server";

export class Renderer
{
	private readonly component: IonAppComponent;
	private readonly req: any;
	private readonly res: Response<any, Record<string, any>>;

	constructor(component: IonAppComponent, req: Request, res: Response)
	{
		this.component = component;
		this.req = req;
		this.res = res;
	}

	public render()
	{
		return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Document</title>
</head>
<body>
	<div id="root">${this.component.renderToString()}</div>
	<script src="/js/vendors.bundle.js"></script>
	<script src="/js/App.bundle.js"></script>
</body>
</html>`.trim();
	}
}

export type RendererType<T extends Renderer> = new (component: IonAppComponent, req: Request, res: Response) => T;
