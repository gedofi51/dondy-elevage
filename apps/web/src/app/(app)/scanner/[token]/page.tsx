import { QrScanResolver } from './qr-scan-resolver';

export default async function ScannerPage(props: PageProps<'/scanner/[token]'>) {
  const { token } = await props.params;
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <QrScanResolver token={token} />
    </div>
  );
}
