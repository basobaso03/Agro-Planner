import React, { useRef, useEffect } from 'react';
import { TabId } from './routes.ts';
import { useNavigation } from './useNavigation.ts';

export interface TabHostProps {
  overviewContent: React.ReactNode;
  operationsContent: React.ReactNode;
  moneyContent: React.ReactNode;
  moreContent: React.ReactNode;
}

export const TabHost: React.FC<TabHostProps> = ({
  overviewContent,
  operationsContent,
  moneyContent,
  moreContent,
}) => {
  const { activeTab } = useNavigation();

  // Track visited tabs so we only mount tabs after their first visit
  const visitedRef = useRef<Set<TabId>>(new Set(['overview']));
  visitedRef.current.add(activeTab);

  const tabs: { id: TabId; content: React.ReactNode }[] = [
    { id: 'overview', content: overviewContent },
    { id: 'operations', content: operationsContent },
    { id: 'money', content: moneyContent },
    { id: 'more', content: moreContent },
  ];

  return (
    <div className="flex-1 w-full relative">
      {tabs.map((tab) => {
        const isVisited = visitedRef.current.has(tab.id);
        if (!isVisited) return null;

        const isActive = activeTab === tab.id;
        return (
          <div
            key={tab.id}
            style={{ display: isActive ? 'block' : 'none' }}
            className="w-full min-h-[calc(100dvh-60px-64px)] pb-24"
          >
            {tab.content}
          </div>
        );
      })}
    </div>
  );
};

