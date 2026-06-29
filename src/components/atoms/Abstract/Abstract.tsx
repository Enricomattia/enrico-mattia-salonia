import Link from "../Link/Link";
import "./Abstract.style.css"

interface AbstractProps {
    content: string;
    availability?: string;
    other?: string;
    link?: string;
    linkother?: string;
    other2?: string;
    linkother2?: string;
}

const Abstract: React.FC<AbstractProps> = ({ content, availability, other, link = "mailto:mattia.salonia1@gmail.com", linkother, other2, linkother2 }) => {
    return (
        <div className="abstract">
            <h5 className="abstract-title text-s">Abstract</h5>
            <p className="abstract-content justify text-m">{content}</p>
            <p className="abstract-availability">{<Link text={availability} href={link} size="text-s"/>}</p>
            <div className="abstract-others">
                <p className="abstract-other">{<Link text={other} href={linkother} size="text-s"/>}</p>
                {other2 && <p className="abstract-other">{<Link text={other2} href={linkother2} size="text-s"/>}</p>}
            </div>
        </div>
    );
};

export default Abstract;
