import { useState, useCallback } from 'react';
import { CircleCheck, X } from 'lucide-react';
import { useDialog } from './useDialog';
import styles from './SupportRequestModal.module.css';
export default function SupportRequestModal({isOpen,onClose,userId}) {
 const [subject,setSubject]=useState('');
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [success,setSuccess]=useState(false);
 const [loading,setLoading]=useState(false);
 const handleClose=useCallback(()=>{setSubject('');setMessage('');setError('');setSuccess(false);onClose()},[onClose]);
 const ref=useDialog(isOpen,handleClose);
 if(!isOpen)return null;
 const handleSubmit=async event=>{
  event.preventDefault();
  if(!subject.trim()||!message.trim()){setError('Заполните тему и текст запроса');return}
  setLoading(true);setError('');
  try{
   const res=await fetch('/api/support',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:userId,subject,message})});
   const data=await res.json();
   if(!res.ok){setError(data.error||'Ошибка отправки запроса');return}
   setSuccess(true);
  }catch{setError('Не удалось подключиться к серверу')}finally{setLoading(false)}
 };
 return <div className={styles.overlay} onClick={handleClose}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="support-title" tabIndex={-1} ref={ref} onClick={e=>e.stopPropagation()}>
  <button className={styles.iconClose} onClick={handleClose} aria-label="Закрыть"><X size={20}/></button>
  {success?<div className={styles.successBox}><CircleCheck className={styles.successIcon} size={42}/><h2 id="support-title">Запрос отправлен</h2><p>Администратор рассмотрит твой запрос. Ответ придёт на указанный в профиле email.</p><button className="primary-button" onClick={handleClose}>Готово</button></div>:
  <form onSubmit={handleSubmit}><span className="eyebrow">Поддержка</span><h2 id="support-title">Чем можем помочь?</h2><p className={styles.hint}>Опиши проблему или вопрос — администратор рассмотрит обращение.</p>
   <label className={styles.label} htmlFor="support-subject">Тема запроса</label><input id="support-subject" className={styles.input} placeholder="Кратко о проблеме" value={subject} maxLength={120} onChange={e=>setSubject(e.target.value)} required/>
   <label className={styles.label} htmlFor="support-message">Сообщение</label><textarea id="support-message" className={styles.textarea} placeholder="Что произошло и как это повторить?" rows={5} value={message} onChange={e=>setMessage(e.target.value)} required/>
   {error&&<p className={styles.error} role="alert">{error}</p>}
   <div className={styles.actions}><button className="primary-button" type="submit" disabled={loading}>{loading?'Отправка…':'Отправить запрос'}</button><button className={styles.cancelBtn} type="button" onClick={handleClose}>Отмена</button></div>
  </form>}
 </section></div>
}