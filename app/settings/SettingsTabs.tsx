"use client";

import { useState } from "react";
import TabGroup from "@/components/TabGroup";
import ProfilePanel from "./ProfilePanel";
import EnginePanel from "./EnginePanel";

export default function SettingsTabs({ isAdmin }: { isAdmin: boolean }) {
  const tabs = isAdmin ? ["PERFIL", "ENGINE"] : ["PERFIL"];
  const [activeTab, setActiveTab] = useState("PERFIL");

  return (
    <div className="space-y-6">
      <TabGroup tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "PERFIL" && <ProfilePanel />}
      {activeTab === "ENGINE" && isAdmin && <EnginePanel />}
    </div>
  );
}
