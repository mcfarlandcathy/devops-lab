
import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadTasks() {
    try {
      setError('')
      const response = await fetch('/tasks')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      setTasks(data)
    } catch (err) {
      setError(`Не удалось загрузить задачи: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  async function addTask(event) {
    event.preventDefault()

    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    try {
      setError('')

      const response = await fetch('/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: trimmedTitle }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const newTask = await response.json()

      setTasks((currentTasks) => [...currentTasks, newTask])
      setTitle('')
    } catch (err) {
      setError(`Не удалось создать задачу: ${err.message}`)
    }
  }

  return (
    <main className="task-app">
      <header className="task-header">
        <p className="eyebrow">DEVOPS LAB</p>
        <h1>Мои задачи</h1>
        <p className="subtitle">
          React · Nginx · Node.js · PostgreSQL
        </p>
      </header>

      <form className="task-form" onSubmit={addTask}>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Что нужно сделать?"
          aria-label="Название задачи"
        />
        <button type="submit" disabled={!title.trim()}>
          Добавить
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <section className="task-list">
        {loading ? (
          <p>Загружаем задачи...</p>
        ) : tasks.length === 0 ? (
          <p>Пока задач нет. Добавь первую!</p>
        ) : (
          tasks.map((task) => (
            <article className="task-item" key={task.id}>
              <span className="task-id">#{task.id}</span>
              <span className="task-title">{task.title}</span>
              <span className="task-status">
                {task.completed ? 'Выполнена' : 'В процессе'}
              </span>
            </article>
          ))
        )}
      </section>

      <footer className="task-footer">
        Всего задач: {tasks.length}
      </footer>
    </main>
  )
}

export default App
