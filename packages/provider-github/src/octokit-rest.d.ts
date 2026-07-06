declare module "@octokit/rest" {
  export class Octokit {
    public constructor(options?: Readonly<Record<string, unknown>>);

    public request<TBody = unknown>(
      route: string,
      parameters?: Readonly<Record<string, unknown>>
    ): Promise<{
      readonly data: TBody;
      readonly headers: Readonly<Record<string, string | number | undefined>>;
      readonly status: number;
    }>;
  }
}
