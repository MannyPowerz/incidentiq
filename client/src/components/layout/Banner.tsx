import './Banner.css';

export default function Banner() {
    return (
        <header className='banner'>
            <div className='banner-content'>
                <h1 className='banner-title'>
                    Incident<span>IQ</span>
                </h1>

                <p className='banner-subtitle'>
                    Detect. Collaborate. Resolve.
                </p>
            </div>
        </header>
    );
}