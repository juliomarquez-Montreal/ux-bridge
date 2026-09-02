"use client";

import { useState } from "react";
import TabGroup from "@/components/TabGroup";
import EnginePanel from "./EnginePanel";

const TABS = ["ENGINE"];

export default function SettingsTabs() {
  const [activeTab, setActiveTab] = useState("ENGINE");

  return (
    <div className="space-y-6">
      <TabGroup tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "ENGINE" && <EnginePanel />}
    </div>
  );
}
