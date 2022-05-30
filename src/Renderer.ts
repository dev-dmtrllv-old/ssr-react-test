import React, { ContextType } from "react";
import ReactDOMServer from "react-dom/server";

export class Renderer<P extends {}>
{
	public readonly component: React.FC<P>;
	public readonly props: P;

	public constructor(component: React.FC<P>, props: P)
	{
		this.component = component;
		this.props = props;
	}

	public async render<P extends {}>()
	{
		await this.resolve(this.component, this.props);
	}

	protected async resolve<P extends {}>(component: React.FC<P>, props: P, contexts: ContextType<any>[] = [])
	{
		const contextTracker = [];

		const html = ReactDOMServer.renderToStaticMarkup(React.createElement(component, props));
	}
}

type ResolveData = {
	contexts: ContextType<any>[];
}
