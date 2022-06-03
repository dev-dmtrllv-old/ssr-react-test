import React from "react";
import { Renderer } from "./Renderer";

export class Context<T>
{
	public static readonly create = <T extends any>(type: T): Context<T> => new this(React.createContext(type));

	public static readonly use = <T extends any>(context: Context<T>): T => React.useContext(context.context);

	private readonly context: React.Context<T>;
	public readonly Consumer: React.Consumer<T>;

	private constructor(context: React.Context<T>)
	{
		this.context = context;
		this.Consumer = this.context.Consumer;
	}

	public readonly use = () => Context.use(this);

	public readonly Provider = ({ value, children }: React.PropsWithChildren<{ value: T }>) =>
	{
		Renderer.trackContext(this, value);

		const jsx = (
			<this.context.Provider value={value}>
				{children}
			</this.context.Provider>
		);

		Renderer.untrackContext(this);

		return jsx;
	}
}
