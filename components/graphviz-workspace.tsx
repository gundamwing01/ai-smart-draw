"use client";

import { GraphvizPreview } from "@/components/graphviz-preview";
import { useGraphviz } from "@/contexts/graphviz-context";
import { GraphvizDefinitionCard } from "@/components/graphviz-definition-card";

export function GraphvizWorkspace() {
    const { definition, setDefinition, clearDefinition, defaultDefinition } = useGraphviz();

    return (
        <div className="flex flex-col h-full gap-1">
            <div className="flex-1 min-h-0">
                <GraphvizPreview />
            </div>
            <div className="h-52">
                <GraphvizDefinitionCard
                    definition={definition}
                    onChange={setDefinition}
                    onClear={clearDefinition}
                    defaultDefinition={defaultDefinition}
                />
            </div>
        </div>
    );
}