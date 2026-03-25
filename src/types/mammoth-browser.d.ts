declare module "mammoth/mammoth.browser" {
  export interface MammothMessage {
    message: string;
    type?: string;
  }

  export interface MammothHtmlResult {
    value: string;
    messages: MammothMessage[];
  }

  export interface MammothBrowser {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<MammothHtmlResult>;
  }

  const mammoth: MammothBrowser;
  export default mammoth;
}
