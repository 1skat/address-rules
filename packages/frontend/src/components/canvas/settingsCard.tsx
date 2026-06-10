import { memo, useState } from "react";
import { Panel } from "@xyflow/react";
import { useToolStore } from "../../store/useToolStore";

export const SettingsCard = memo(() => {
    const activeTool = useToolStore(s => s.activeTool);

    if (activeTool === "add") return <AddNodeCard />;
    // if (activeTool === "cursor") return <CursorCard />;
    // etc
    return null;
});

const AddNodeCard = memo(() => {
    const [chainSelected, setChainSelected] = useState("SOL");

    const chains = ["SOL", "ETH", "BTC"];
    return (
        <Panel className="absolute left">
            <div className="left-4 border-2">
                {chains.map((c) => (
                    <button
                        key={c}
                        onClick={() => setChainSelected(c)}
                        className={`px-4 ${chainSelected === c ? "bg-blue-300" : "bg-amber-100"}`}
                    >
                        {c}
                    </button>
                ))}
            </div>
        </Panel>
    );
});
