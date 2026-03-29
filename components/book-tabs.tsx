"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"

interface BookTabsProps {
  reviewsContent: React.ReactNode
  charactersContent: React.ReactNode
  aiImagesContent: React.ReactNode
  unavailableContent: React.ReactNode
  dbBookAvailable: boolean
}

export function BookTabs({
  reviewsContent,
  charactersContent,
  aiImagesContent,
  unavailableContent,
  dbBookAvailable,
}: BookTabsProps) {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get("tab") ?? "reviews"
  })

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-grid">
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
        <TabsTrigger value="characters">Characters</TabsTrigger>
        <TabsTrigger value="ai-images">AI Images</TabsTrigger>
      </TabsList>

      <Card className="mt-6 p-6 min-h-[300px]">
        <TabsContent value="reviews" className="mt-0">
          {dbBookAvailable ? reviewsContent : unavailableContent}
        </TabsContent>
        <TabsContent value="characters" className="mt-0">
          {dbBookAvailable ? charactersContent : unavailableContent}
        </TabsContent>
        <TabsContent value="ai-images" className="mt-0">
          {dbBookAvailable ? aiImagesContent : unavailableContent}
        </TabsContent>
      </Card>
    </Tabs>
  )
}
