import Link from "../Link/Link";
import "./Abstract.style.css"

interface AbstractProps {
    content: string;
    availability?: string;
    other?: string;
    link?: string;
    linkother?: string;
}

const Abstract: React.FC<AbstractProps> = ({ content, availability, other, link = "mailto:mattia.salonia1@gmail.com", linkother }) => {
    return (
        <div className="abstract">
            <h5 className="abstract-title text-s">Abstract</h5>
            <p className="abstract-content justify text-m">{content}</p>
            <p className="abstract-availability">{<Link text={availability} href={link} size="text-s"/>}</p>
            <p className="abstract-other">{<Link text={other} href={linkother} size="text-s"/>}</p>
        </div>
    );
};

export default Abstract;
