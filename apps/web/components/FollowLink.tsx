/** A page's own feed, in words: "Follow this pledge by RSS", with a way to find out what RSS is. */
export function FollowLink({ href, label }: { href: string; label: string }) {
  return (
    <p className="follow small">
      <a href={href} type="application/rss+xml">
        {label}
      </a>{" "}
      <a className="muted" href="/follow">
        What is RSS?
      </a>
    </p>
  );
}
