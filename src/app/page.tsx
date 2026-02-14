'use client'

import { Button } from '@/components/ui/button'
import { useMutation, useQueries, useQuery } from 'convex/react'
import Image from 'next/image'
import { get } from '../../convex/projects'
import { api } from '../../convex/_generated/api'

export default function Home() {
  const projects = useQuery(api.projects.get)
  const createProject = useMutation(api.projects.create)
  return (
    <div className="flex flex-col gap-2 p-4">
      <Button onClick={() => createProject({
        name: "New Project 12"
      })}>
        Add new
      </Button>
      {projects?.map((project) => (
        <div key={project._id} className="border rounded p-2 flex flex-col">
          <p>{project.name}</p>
          <p> Owner Id: {project.ownerId}</p>
        </div>
      ))}
    </div>
  )
}
