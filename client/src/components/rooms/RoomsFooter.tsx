import type { JSX } from "react";
import "./RoomsFooter.css"

type RoomsFooterProps = {
    currentPage: number
    totalPages:number
    startIndex: number
    endIndex: number
    totalRooms: number
    onPageChange: (page: number) => void
}

export default function RoomsFooter ({ 
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    totalRooms,
    onPageChange,
 }: RoomsFooterProps) : JSX.Element {

    const pageNumbers = Array.from(
        { length: totalPages},
        ( _, index) => index + 1,
    )

    return (
        <footer className="rooms-footer">
            <p className="rooms-footer-summary">
                {totalRooms === 0
                ? "Showing 0 rooms"
                : `Showing ${startIndex} to ${endIndex} of ${totalRooms} rooms`}
            </p>

            <nav className="rooms-footer-controls" aria-label="Rooms pagination">
                <button 
                    type="button" 
                    className="rooms-footer-button" 
                    disabled={currentPage === 1}
                    onClick={() => onPageChange(currentPage - 1)}    
                >
                    Prev
                </button>

                {pageNumbers.map((page) => (
                    <button
                        type="button"
                        key={page}
                        className={
                            currentPage === page
                            ? "rooms-footer-button rooms-footer-button-active"
                            : "rooms-footer-button"
                        }
                        aria-current={currentPage === page ? "page" : undefined}
                        onClick={() => onPageChange(page)}
                    >
                        {page}
                    </button>
                ))}

                <button
                    type="button"
                    className="rooms-footer-button"
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => onPageChange(currentPage + 1)}
                >
                    Next
                </button>
            </nav>
        </footer>
    )
}