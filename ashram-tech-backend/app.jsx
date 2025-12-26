import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

function Page() {
  const [todos, setTodos] = useState([])

  useEffect(() => {
    const getTodos = async () => {
      const { data, error } = await supabase
        .from('todos')
        .select('*')

      if (error) {
        console.error(error)
        return
      }

      setTodos(data)
    }

    getTodos()
  }, [])

  return (
    <div>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </div>
  )
}

export default Page
