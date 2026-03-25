export type TestFixtureId = "locked-pdf" | "locked-zip";

export interface TestFixture {
  id: TestFixtureId;
  label: string;
  description: string;
  fileName: string;
  mimeType: string;
  password: string;
  base64: string;
}

export const TEST_FIXTURES: readonly TestFixture[] = [
  {
    id: "locked-pdf",
    label: "Locked PDF",
    description: "Password-protected PDF preview fixture.",
    fileName: "shoshum-password-test.pdf",
    mimeType: "application/pdf",
    password: "secret123",
    base64:
      "JVBERi0xLjMKJeLjz9MKMSAwIG9iago8PAovUHJvZHVjZXIgPGI5ZGVhOTdkZTc+Cj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovQ291bnQgMQovS2lkcyBbIDQgMCBSIF0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9SZXNvdXJjZXMgPDwKPj4KL01lZGlhQm94IFsgMC4wIDAuMCAzMDAgMjAwIF0KL1BhcmVudCAyIDAgUgo+PgplbmRvYmoKNSAwIG9iago8PAovViAyCi9SIDMKL0xlbmd0aCAxMjgKL1AgNDI5NDk2NzI5MgovRmlsdGVyIC9TdGFuZGFyZAovTyA8NmFjNDdkOTQ5MGRjNjBjNzc1YmRlNWM0MDQ3OWU0NDEyODZmMzY0MDlkOTM1ZTNlMGM4Y2NlNDYwZTk1NzZhND4KL1UgPDM3OTI1ZGU1MDEwYmU5MGY0ZDJlZDE3ZDlhZTAzZGI0MjhiZjRlNWU0ZTc1OGE0MTY0MDA0ZTU2ZmZmYTAxMDg+Cj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA1OSAwMDAwMCBuIAowMDAwMDAwMTE4IDAwMDAwIG4gCjAwMDAwMDAxNjcgMDAwMDAgbiAKMDAwMDAwMDI2MSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDYKL1Jvb3QgMyAwIFIKL0luZm8gMSAwIFIKL0lEIFsgPDMzMzYzMDY0MzAzNzM0NjUzMjM3MzYzMDMzMzEzMTM2MzA2MzYzMzU2MTYxMzAzNzY0NjUzNzM0Mzc2MjYzNjU+IDwzMzM2MzA2NDMwMzczNDY1MzIzNzM2MzAzMzMxMzEzNjMwNjM2MzM1NjE2MTMwMzc2NDY1MzczNDM3NjI2MzY1PiBdCi9FbmNyeXB0IDUgMCBSCj4+CnN0YXJ0eHJlZgo0NzYKJSVFT0YK",
  },
  {
    id: "locked-zip",
    label: "Locked ZIP",
    description: "Password-protected archive entry fixture.",
    fileName: "shoshum-password-test.zip",
    mimeType: "application/zip",
    password: "secret123",
    base64:
      "UEsDBAoACQAAAFWseFz4udqMJQAAABkAAAAaABwAc2hvc2h1bS1hcmNoaXZlLXNvdXJjZS50eHRVVAkAA8JJw2nCScNpdXgLAAEE9QEAAAQAAAAAntO5WUH7q3Kb1PIWsTIJdlCJg48rn5Xo1eAkKHE1KEpsRrxdY1BLBwj4udqMJQAAABkAAABQSwECHgMKAAkAAABVrHhc+LnajCUAAAAZAAAAGgAYAAAAAAABAAAApIEAAAAAc2hvc2h1bS1hcmNoaXZlLXNvdXJjZS50eHRVVAUAA8JJw2l1eAsAAQT1AQAABAAAAABQSwUGAAAAAAEAAQBgAAAAiQAAAAAA",
  },
] as const;

export function getTestFixtureById(id: TestFixtureId): TestFixture {
  const fixture = TEST_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) {
    throw new Error(`Unknown test fixture: ${id}`);
  }
  return fixture;
}

export function decodeFixtureBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function getTestFixtureBytes(id: TestFixtureId): Uint8Array {
  return decodeFixtureBase64(getTestFixtureById(id).base64);
}
