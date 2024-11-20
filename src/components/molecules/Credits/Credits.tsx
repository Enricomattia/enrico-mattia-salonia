import "./Credits.style.css"; 

const Credits = () => {
    return (
        <div className="logo-container">
            <span className="crafted-by">Designed and Developed by:</span>
            <a href="https://www.lorenzosantucci.com" aria-label="Link to Lorenzo Santucci's website" target="_blank">
                <div className="logo-credits">
                    <p className="text">L:<span className="blink">\</span></p>
                </div>
            </a>
        </div>
    );
};

export default Credits;
