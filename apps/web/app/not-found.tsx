import Link from "next/link";
export default function NotFound() {
  return (<div className="py-20"><h1 className="font-display text-[30px]">Not covered</h1><p className="mt-2 text-sm text-muted">That page or stock is not in the pilot universe. Search with ⌘K, or go <Link className="text-accent hover:underline" href="/">home</Link>.</p></div>);
}
