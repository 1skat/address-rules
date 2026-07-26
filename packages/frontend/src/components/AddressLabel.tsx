import { useState } from "react"
import { shortFormat } from "../utils/utils";

export const AddressLabel = ({ address }: { address: string }) => {
    const [show, setShow] = useState(false);

    return (
        <div
            className="relative"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            <span
            >
                {shortFormat(address)}
            </span>
            {show && (
                <div>
                    {address}
                </div>
            )}
        </div>
    )
}
