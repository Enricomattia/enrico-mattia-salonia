import "./Link.style.css";

interface LinkProps {
    href?: string;
    text?: string;
    size?: string;
    target?: string;
}

const Link: React.FC<LinkProps> = ({ href = "link", text, size = "text-l", target = "_blank" }) => {
    return (
        <a className={"link "+ size} href={href} target={target}>{text}</a>
    );
}

export default Link;
